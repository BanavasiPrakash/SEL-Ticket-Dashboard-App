import React, { useEffect, useMemo, useState } from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

const statusColors = {
  open: "#bd2331",
  hold: "#ffc107",
  inProgress: "#8fc63d",
  escalated: "#ef6724",
  unassigned: "#1e4489"
};

function formatDateWithMonthName(dateString) {
  if (!dateString) return "";
  let match = dateString.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4}),?\s*(\d{2}):(\d{2})/);
  if (match) {
    const [_, dd, mm, yyyy, HH, MM] = match;
    const months = [
      "January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"
    ];
    const mIndex = parseInt(mm, 10) - 1;
    return `${dd} ${months[mIndex]} ${yyyy}, ${HH}:${MM}`;
  }
  const dt = new Date(dateString);
  if (!isNaN(dt)) {
    const day = dt.getDate().toString().padStart(2, '0');
    const month = dt.toLocaleString('default', { month: 'long' });
    const year = dt.getFullYear();
    const hour = dt.getHours().toString().padStart(2, '0');
    const minute = dt.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hour}:${minute}`;
  }
  return dateString;
}

function normalizeStatus(text) {
  if (!text) return "";
  const t = text.replace(/[\s\-_]/g, "").toLowerCase();
  if (t === "hold" || t === "onhold") return "hold";
  if (t === "inprogress" || t === "in-progress" || t === "in_progress") return "inProgress";
  if (t === "open") return "open";
  if (t === "escalated") return "escalated";
  return t;
}

const statusKeyMap = {
  open: "open",
  hold: "hold",
  "on-hold": "hold",
  onhold: "hold",
  "in-progress": "inProgress",
  inprogress: "inProgress",
  "in_progress": "inProgress",
  escalated: "escalated"
};

export default function AgentTicketAgeTable({
  membersData,
  onClose,
  selectedAges = ["fifteenDays", "sixteenToThirty", "month"],
  selectedStatuses = [],
  showTimeDropdown,
  selectedDepartmentId,
  selectedAgentNames = [],
  departmentsMap = {},
  departmentViewEnabled,
  setDepartmentViewEnabled
}) {
  const [hoveredRowIndex, setHoveredRowIndex] = useState(null);

  const showPendingTable = selectedAges.includes("pending");

  const ageColumns = [
    { key: "fifteenDays", label: "1 - 15 Days Tickets", ageProp: "BetweenOneAndFifteenDays" },
    { key: "sixteenToThirty", label: "16 - 30 Days Tickets", ageProp: "BetweenSixteenAndThirtyDays" },
    { key: "month", label: "30+ DaysTickets", ageProp: "OlderThanThirtyDays" }
  ];

  const visibleAgeColumns = ageColumns.filter(col => selectedAges.includes(col.key));
  const columnsToShow = [
    { key: "serial", label: "SI. NO." },
    { key: "name", label: "Agent Name" },
    ...(selectedDepartmentId ? [{ key: "department", label: "Department" }] : []),
    { key: "total", label: "Total Ticket Count" },
    ...visibleAgeColumns
  ];

  const statusOrder = ['open', 'hold', 'inProgress', 'escalated'];
  const statusMapSort = {
    open: 0,
    hold: 1,
    inprogress: 2,
    inProgress: 2,
    escalated: 3
  };

  const normalizedStatusKeys = (selectedStatuses && selectedStatuses.length > 0)
    ? selectedStatuses.map(st =>
      normalizeStatus(st.value || st)
    )
    : [];

  // CHANGE: Add 'totalTickets' after department in pendingTableColumns
  const pendingTableColumns = [
    { key: "name", label: "Agent Name" },
    { key: "department", label: "Department Name" },
    { key: "totalTickets", label: "Total Pending Tickets" },
    { key: "status", label: "Ticket Status" },
    { key: "ticketNumber", label: "Ticket Number" },
    { key: "ticketCreated", label: "Ticket Created Date & Time" },
    { key: "daysNotResponded", label: "Ticket Age Days " }
  ];

  const normalizedStatusKeysSet =
    normalizedStatusKeys.length > 0
      ? new Set(normalizedStatusKeys)
      : null;

  const pendingTableRows = useMemo(() => {
    if (!membersData || !Array.isArray(membersData)) return [];
    let filteredAgents = membersData;
    if (selectedDepartmentId) {
      filteredAgents = filteredAgents.filter(agent =>
        Array.isArray(agent.departmentIds) && agent.departmentIds.includes(selectedDepartmentId)
      );
    }
    if (selectedAgentNames && selectedAgentNames.length > 0) {
      filteredAgents = filteredAgents.filter(agent =>
        selectedAgentNames.includes(agent.name)
      );
    }
    let rows = [];
    filteredAgents.forEach(agent => {
      (agent.pendingTickets || [])
        .filter(tkt =>
          !selectedDepartmentId ||
          tkt.departmentId === selectedDepartmentId ||
          tkt.departmentName === departmentsMap[selectedDepartmentId]?.name
        )
        .forEach(tkt => {
          const tktNorm = normalizeStatus(tkt.status);
          if (normalizedStatusKeysSet && !normalizedStatusKeysSet.has(tktNorm)) return;
          let sortKey = (tktNorm === 'inprogress' ? 'inProgress' : tktNorm);
          let dr = (tkt.daysNotResponded !== undefined && tkt.daysNotResponded !== "" && !isNaN(Number(tkt.daysNotResponded)))
            ? (Number(tkt.daysNotResponded) < 1 ? 0 : Number(tkt.daysNotResponded))
            : "";
          rows.push({
            name: agent.name || "",
            department: tkt.departmentName || "",
            status: tkt.status || "",
            statusSort: statusMapSort[sortKey] ?? 99,
            ticketNumber: tkt.ticketNumber || "",
            ticketCreated: tkt.ticketCreated || "",
            daysNotResponded: dr
          });
        });
    });
    return rows.sort((a, b) => {
      const nameCmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (nameCmp !== 0) return nameCmp;
      return (a.statusSort ?? 99) - (b.statusSort ?? 99);
    });
  }, [membersData, selectedDepartmentId, selectedAgentNames, normalizedStatusKeysSet, departmentsMap]);

  // CHANGE: Add totalTickets field per agent group and render
  const groupedPendingRows = useMemo(() => {
    const grouped = {};
    pendingTableRows.forEach(row => {
      if (!grouped[row.name]) grouped[row.name] = [];
      grouped[row.name].push(row);
    });
    const finalRows = [];
    Object.keys(grouped).forEach(agent => {
      const totalTickets = grouped[agent].length;
      grouped[agent].forEach((row, i) => {
        finalRows.push({
          ...row,
          totalTickets,
          _isFirst: i === 0,
          _rowSpan: grouped[agent].length
        });
      });
    });
    return finalRows;
  }, [pendingTableRows]);

  const departmentRows = useMemo(() => {
    if (!departmentViewEnabled) return null;
    const byDept = {};
    Object.entries(departmentsMap).forEach(([deptId, info]) => {
      byDept[deptId] = {
        departmentName: info.name || deptId,
        ticketSet: new Set(),
        tickets_1_7_open: 0,
        tickets_1_7_hold: 0,
        tickets_1_7_inProgress: 0,
        tickets_1_7_escalated: 0,
        tickets_8_15_open: 0,
        tickets_8_15_hold: 0,
        tickets_8_15_inProgress: 0,
        tickets_8_15_escalated: 0,
        tickets_15plus_open: 0,
        tickets_15plus_hold: 0,
        tickets_15plus_inProgress: 0,
        tickets_15plus_escalated: 0,
        tickets_1_7_open_numbers: [],
        tickets_1_7_hold_numbers: [],
        tickets_1_7_inProgress_numbers: [],
        tickets_1_7_escalated_numbers: [],
        tickets_8_15_open_numbers: [],
        tickets_8_15_hold_numbers: [],
        tickets_8_15_inProgress_numbers: [],
        tickets_8_15_escalated_numbers: [],
        tickets_15plus_open_numbers: [],
        tickets_15plus_hold_numbers: [],
        tickets_15plus_inProgress_numbers: [],
        tickets_15plus_escalated_numbers: [],
      };
    });
    (membersData || []).forEach(agent => {
      Object.entries(agent.departmentAgingCounts || {}).forEach(([deptId, agingCounts]) => {
        if (!byDept[deptId]) return;
        statusOrder.forEach(key => {
          (agingCounts[`${key}BetweenOneAndSevenDaysTickets`] || []).forEach(ticketNum => {
            byDept[deptId][`tickets_1_7_${key}`] += 1;
            byDept[deptId][`tickets_1_7_${key}_numbers`].push(ticketNum);
          });
          (agingCounts[`${key}BetweenEightAndFifteenDaysTickets`] || []).forEach(ticketNum => {
            byDept[deptId][`tickets_8_15_${key}`] += 1;
            byDept[deptId][`tickets_8_15_${key}_numbers`].push(ticketNum);
          });
          (agingCounts[`${key}OlderThanFifteenDaysTickets`] || []).forEach(ticketNum => {
            byDept[deptId][`tickets_15plus_${key}`] += 1;
            byDept[deptId][`tickets_15plus_${key}_numbers`].push(ticketNum);
          });
        });
      });
    });
    const sortedRows = Object.entries(byDept)
      .map(([deptId, data]) => ({
        ...data,
        total:
          data.tickets_1_7_open + data.tickets_1_7_hold + data.tickets_1_7_inProgress + data.tickets_1_7_escalated +
          data.tickets_8_15_open + data.tickets_8_15_hold + data.tickets_8_15_inProgress + data.tickets_8_15_escalated +
          data.tickets_15plus_open + data.tickets_15plus_hold + data.tickets_15plus_inProgress + data.tickets_15plus_escalated
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName, undefined, { sensitivity: 'base' }))
      .map((row, idx) => ({
        si: idx + 1,
        ...row
      }));
    return sortedRows;
  }, [membersData, departmentsMap, departmentViewEnabled]);

  const baseFont = `'Montserrat', 'Poppins', sans-serif`;
  const centerCellStyle = {
    padding: 14,
    fontWeight: 700,
    fontFamily: baseFont,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #23272f 60%, #15171a 100%)',
    color: 'white',
    borderTop: '2px solid #1E4489',
    borderLeft: '2px solid #1E4489',
    borderBottom: '2.5px solid #1E4489',
    borderRight: '2.5px solid #1E4489',
    transition: 'background 0.18s',
    cursor: 'pointer',
    textAlign: 'center',
    verticalAlign: 'middle'
  };

  const leftCellStyle = {
    ...centerCellStyle,
    textAlign: 'left'
  };
  const serialHeaderStyle = {
    ...centerCellStyle,
    width: 30,
    minWidth: 30,
    maxWidth: 40,
    textAlign: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    fontWeight: 900,
    background: 'linear-gradient(135deg, #1E4489 70%, #1E4489 100%)'
  };

  const centerCellStyleHovered = {
    ...centerCellStyle,
    background: 'linear-gradient(135deg, #1E4489 60%, #1E4489 100%)',
    color: 'white'
  };

  const headerStyle3D = {
    padding: 14,
    textAlign: 'center',
    fontWeight: 900,
    fontFamily: baseFont,
    background: 'linear-gradient(135deg, #1E4489 70%, #1E4489 100%)',
    color: 'white',
    borderTop: '2px solid #5375ce',
    borderLeft: '2px solid #6d90e5',
    borderBottom: '2px solid #1e2950',
    borderRight: '2px solid #182345',
    borderRadius: '12px 12px 0 0',
    position: 'sticky',
    top: 0,
    zIndex: 2
  };

  useEffect(() => {
    const handleDoubleClick = () => {
      if (onClose) onClose();
    };
    window.addEventListener('dblclick', handleDoubleClick);
    return () => window.removeEventListener('dblclick', handleDoubleClick);
  }, [onClose]);

  function aggregateTickets(agent, ageProp, status) {
    if (!selectedDepartmentId && agent.departmentAgingCounts) {
      return Object.values(agent.departmentAgingCounts).flatMap(age =>
        age?.[status + ageProp + 'Tickets'] || []
      );
    }
    return selectedDepartmentId && agent.departmentAgingCounts?.[selectedDepartmentId]
      ? agent.departmentAgingCounts[selectedDepartmentId][status + ageProp + 'Tickets'] || []
      : [];
  }

  function countFromArray(agent, ageProp, status) {
    return aggregateTickets(agent, ageProp, status).length;
  }

  function ticketNumbersForDeptRow(row, bucket, statusKey) {
    return row[`tickets_${bucket}_${statusKey}_numbers`] || [];
  }

  const tableRows = (membersData || [])
    .filter(agent => {
      if (selectedDepartmentId) {
        const agentHasTickets =
          (agent.departmentTicketCounts?.[selectedDepartmentId] || 0) > 0 ||
          Object.values(agent.departmentAgingCounts?.[selectedDepartmentId] || {}).some(v => v > 0);
        const nameMatch = !selectedAgentNames.length || selectedAgentNames.includes(agent.name.trim());
        return agentHasTickets && nameMatch;
      } else {
        const t = agent.tickets || {};
        return (t.open || 0) + (t.hold || 0) + (t.escalated || 0) + (t.unassigned || 0) + (t.inProgress || 0) > 0;
      }
    })
    .map(agent => {
      let agingCounts = {};
      if (selectedDepartmentId) {
        agingCounts = agent.departmentAgingCounts?.[selectedDepartmentId] || {};
      } else if (agent.tickets) {
        agingCounts = agent.tickets;
      }
      return {
        name: agent.name,
        agingCounts,
        departmentAgingCounts: agent.departmentAgingCounts,
        departmentName: selectedDepartmentId ? (departmentsMap?.[selectedDepartmentId]?.name || selectedDepartmentId) : ""
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ fontFamily: baseFont }}>
      <div
        style={{
          margin: '24px auto',
          borderRadius: 16,
          border: '2px solid #32406b',
          background: '#16171a',
          width: "100%",
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "100vh"
        }}
      >
        {showPendingTable ? (
          <table style={{
            width: '100%',
            borderCollapse: 'separate',
            borderRadius: 16,
            fontSize: 14,
            fontFamily: baseFont,
            tableLayout: 'auto'
          }}>
            <thead>
              <tr>
                {pendingTableColumns.map(col => (
                  <th key={col.key}
                    style={{
                      padding: 14,
                      textAlign: col.key === "name" || col.key === "department" ? "left" : "center",
                      fontWeight: 900,
                      background: 'linear-gradient(135deg, #1E4489 70%, #1E4489 100%)',
                      color: 'white',
                      borderRadius: '12px 12px 0 0',
                      borderTop: '2px solid #5375ce',
                      borderLeft: '2px solid #6d90e5',
                      borderBottom: '2px solid #1e2950',
                      borderRight: '2px solid #182345',
                      fontFamily: baseFont,
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                    }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedPendingRows.length === 0 ? (
                <tr>
                  <td colSpan={pendingTableColumns.length}
                    style={{
                      textAlign: 'center', padding: 28,
                      color: 'WHITE', fontSize: 19,
                      background: 'linear-gradient(110deg, #181b26 80%, #16171a 100%)',
                      borderRadius: 14
                    }}>
                    No pending status tickets found.
                  </td>
                </tr>
              ) : (
                groupedPendingRows.map((row, idx) => (
                  <tr key={`${row.name}_${row.ticketNumber}_${idx}`}>
                    {row._isFirst ? (
                      <td style={leftCellStyle} rowSpan={row._rowSpan}>{row.name}</td>
                    ) : null}
                    <td style={leftCellStyle}>{row.department}</td>
                    {row._isFirst ? (
                      <td style={centerCellStyle} rowSpan={row._rowSpan}>{row.totalTickets}</td>
                    ) : null}
                    <td style={centerCellStyle}>{row.status}</td>
                    <td style={centerCellStyle}>{row.ticketNumber}</td>
                    <td style={centerCellStyle}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%"
                      }}>
                        <span>{formatDateWithMonthName(row.ticketCreated).split(',')[0]}</span>
                        <span>{formatDateWithMonthName(row.ticketCreated).split(',')[1]}</span>
                      </div>
                    </td>
                    <td style={centerCellStyle}>
                      {row.daysNotResponded !== "" && Number(row.daysNotResponded) < 1 ? 0 : row.daysNotResponded}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : departmentViewEnabled ? (
          <table style={{
            width: '100%',
            borderCollapse: 'separate',
            borderRadius: 16,
            fontSize: 18,
            tableLayout: 'auto'
          }}>
            <thead>
              <tr>
                <th style={serialHeaderStyle}>SI. No.</th>
                <th style={{ ...headerStyle3D, textAlign: 'left' }}>Department Name</th>
                <th style={headerStyle3D}>Total Ticket Count</th>
                <th style={headerStyle3D}>1 - 7 Days Tickets</th>
                <th style={headerStyle3D}>8 - 15 Days Tickets</th>
                <th style={headerStyle3D}>15+ Days Tickets</th>
              </tr>
            </thead>
            <tbody>
              {(!departmentRows || departmentRows.length === 0) ? (
                <tr>
                  <td colSpan={6} style={{
                    textAlign: 'center',
                    padding: 28,
                    color: 'WHITE',
                    fontSize: 19,
                    background: 'linear-gradient(110deg, #181b26 80%, #16171a 100%)',
                    borderRadius: 14
                  }}>
                    No department ticket data available
                  </td>
                </tr>
              ) : (
                departmentRows.map(row => (
                  <tr key={row.departmentName} style={{
                    background: 'linear-gradient(120deg, #16171a 82%, #232d3d 100%)',
                    color: 'white',
                    fontSize: 17,
                    fontWeight: 700,
                    borderBottom: '2px solid #2b3243'
                  }}>
                    <td style={centerCellStyle}>{row.si}</td>
                    <td style={leftCellStyle}>{row.departmentName}</td>
                    <td style={centerCellStyle}>{row.total}</td>
                    {["1_7", "8_15", "15plus"].map((bucket) => (
                      <td key={bucket} style={centerCellStyle}>
                        {normalizedStatusKeys.length === 0 ? (
                          <Tippy content={
                            statusOrder
                              .map(statusKey => (row[`tickets_${bucket}_${statusKey}_numbers`] || []))
                              .reduce((a, b) => a.concat(b), []).join(', ') || "No tickets"
                          }>
                            <span
                              style={{
                                fontWeight: 900,
                                fontSize: "18px",
                                color: "white",
                                background: "none",
                                borderRadius: "8px",
                                padding: "2px 0",
                                minWidth: "40px",
                                minHeight: "10px",
                                textAlign: "center",
                                display: "inline-block"
                              }}
                              // title="Total tickets in this age range"
                            >
                              {
                                statusOrder.reduce(
                                  (sum, key) => sum + (row[`tickets_${bucket}_${key}`] ?? 0),
                                  0
                                )
                              }
                            </span>
                          </Tippy>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                            {normalizedStatusKeys.map(statusKey => (
                              <Tippy
                                key={statusKey}
                                content={
                                  ticketNumbersForDeptRow(row, bucket, statusKey).length > 0
                                    ? ticketNumbersForDeptRow(row, bucket, statusKey).join(', ')
                                    : "No tickets"
                                }
                              >
                                <span
                                  className={`agent-status-box ${statusKey}`}
                                  style={{
                                    background: "#15171a",
                                    color: "white",
                                    borderRadius: "12px",
                                    fontWeight: 900,
                                    fontSize: "18px",
                                    minWidth: "40px",
                                    minHeight: "36px",
                                    margin: "2px 6px",
                                    textAlign: "center",
                                    boxShadow: "0 2px 8px #0a0a0a",
                                    border: "none",
                                    borderTop: `6px solid ${statusColors[statusKey] || "#fff"}`,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontFamily: baseFont
                                  }}
                                  title={statusKey.charAt(0).toUpperCase() + statusKey.slice(1) + ' tickets'}
                                >
                                  {row[`tickets_${bucket}_${statusKey}`] ?? 0}
                                </span>
                              </Tippy>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'separate',
            borderRadius: 16,
            fontSize: 18,
            tableLayout: 'auto'
          }}>
            <thead>
              <tr>
                {columnsToShow.map(col => (
                  <th
                    key={col.key}
                    style={col.key === "serial"
                      ? serialHeaderStyle
                      : col.key === "name" || col.key === "department"
                        ? { ...headerStyle3D, textAlign: 'left' }
                        : headerStyle3D}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={columnsToShow.length} style={{
                    textAlign: 'center',
                    padding: 28,
                    color: 'WHITE',
                    fontSize: 19,
                    background: 'linear-gradient(110deg, #181b26 80%, #16171a 100%)',
                    borderRadius: 14
                  }}>
                    {selectedDepartmentId && departmentsMap?.[selectedDepartmentId]?.name
                      ? <>Looks like the <span style={{ fontWeight: 700 }}>{departmentsMap[selectedDepartmentId].name}</span> department has no tickets right now.</>
                      : "No data available"}
                  </td>
                </tr>
              ) : (
                tableRows.map((row, rowIndex) => (
                  <tr
                    key={row.name}
                    style={{
                      background: hoveredRowIndex === rowIndex
                        ? 'linear-gradient(120deg, #2446a3 85%, #293956 100%)'
                        : 'linear-gradient(120deg, #16171a 82%, #232d3d 100%)',
                      color: 'white',
                      fontSize: 17,
                      fontWeight: 700,
                      borderBottom: '2px solid #2b3243'
                    }}
                  >
                    <td style={hoveredRowIndex === rowIndex ? centerCellStyleHovered : centerCellStyle}>{rowIndex + 1}</td>
                    <td
                      style={hoveredRowIndex === rowIndex ? { ...leftCellStyle } : { ...leftCellStyle }}
                      onMouseEnter={() => setHoveredRowIndex(rowIndex)}
                      onMouseLeave={() => setHoveredRowIndex(null)}
                    >
                      {row.name}
                    </td>
                    {selectedDepartmentId && (
                      <td style={hoveredRowIndex === rowIndex ? leftCellStyle : leftCellStyle}>
                        {row.departmentName}
                      </td>
                    )}
                    <td style={hoveredRowIndex === rowIndex ? centerCellStyleHovered : centerCellStyle}>
                      {visibleAgeColumns.reduce((sum, col) => (
                        sum +
                        countFromArray(row, col.ageProp, 'open') +
                        countFromArray(row, col.ageProp, 'hold') +
                        countFromArray(row, col.ageProp, 'inProgress') +
                        countFromArray(row, col.ageProp, 'escalated')
                      ), 0)}
                    </td>
                    {visibleAgeColumns.map(col => (
                      <td
                        key={col.key}
                        style={hoveredRowIndex === rowIndex ? centerCellStyleHovered : centerCellStyle}
                      >
                        {normalizedStatusKeys.length === 0 ? (
                          <Tippy content={
                            statusOrder
                              .map(key => aggregateTickets(row, col.ageProp, key))
                              .reduce((a, b) => a.concat(b), []).join(', ') || "No tickets"
                          }>
                            <span
                              style={{
                                fontWeight: 900,
                                fontSize: "18px",
                                color: "white",
                                background: "none",
                                borderRadius: "8px",
                                padding: "8px 0",
                                minWidth: "40px",
                                minHeight: "10px",
                                textAlign: "center",
                                display: "inline-block"
                              }}
                              title="Total tickets in this age range"
                            >
                              {
                                statusOrder.reduce(
                                  (sum, key) => sum + countFromArray(row, col.ageProp, key),
                                  0
                                )
                              }
                            </span>
                          </Tippy>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                            {normalizedStatusKeys.map(statusKey => (
                              <Tippy
                                key={statusKey}
                                content={
                                  aggregateTickets(row, col.ageProp, statusKey).length > 0
                                    ? aggregateTickets(row, col.ageProp, statusKey).join(', ')
                                    : "No tickets"
                                }
                              >
                                <span
                                  className={`agent-status-box ${statusKey}`}
                                  style={{
                                    background: "#15171a",
                                    color: "white",
                                    borderRadius: "12px",
                                    fontWeight: 900,
                                    fontSize: "18px",
                                    minWidth: "40px",
                                    minHeight: "36px",
                                    margin: "2px 6px",
                                    textAlign: "center",
                                    boxShadow: "0 2px 8px #0a0a0a",
                                    border: "none",
                                    borderTop: `6px solid ${statusColors[statusKey] || "#fff"}`,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontFamily: baseFont
                                  }}
                                  title={statusKey.charAt(0).toUpperCase() + statusKey.slice(1) + ' tickets'}
                                >
                                  {countFromArray(row, col.ageProp, statusKey)}
                                </span>
                              </Tippy>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

//Final