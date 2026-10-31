import React from 'react';
import { ROLE_INFO } from '../roles';

/* Checkboxes for what a person can see and do in the system */
export function RoleChecks({ value = [], onChange, lockAdmin, disabled }) {
  const toggle = (k, on) => onChange(on ? [...value.filter((x) => x !== k), k] : value.filter((x) => x !== k));
  return (
    <div className="role-grid">
      {ROLE_INFO.map(([k, label, desc]) => {
        const checked = value.includes(k);
        const locked = disabled || (lockAdmin && k === 'admin');
        return (
          <label key={k} className={'role-opt' + (checked ? ' on' : '') + (locked ? ' locked' : '')}>
            <input type="checkbox" checked={checked} disabled={locked} onChange={(e) => toggle(k, e.target.checked)} />
            <span><b>{label}</b><span className="muted small">{desc}</span></span>
          </label>
        );
      })}
    </div>
  );
}
