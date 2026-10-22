import { useEffect, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import type { Team } from '@shared/types';
import { uid } from '@shared/domain/random';
import { cmd } from '../../utils/commands';
import { Button } from '../ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '../ui/Field';
import { Drawer } from '../ui/Overlay';
import { Banner } from '../ui/Primitives';

export const blankTeam = (): Team => ({ id: uid('t'), name: '', description: '', leadId: '', status: 'Active' });

export function TeamFormDrawer({ team, onClose }: {team: Team | null;onClose: () => void;}) {
  const { state } = useData();
  const { mutate, pending, error, setError } = useMutation();
  const [f, setF] = useState<Team | null>(team);
  const [members, setMembers] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    setF(team);
    setMembers(team ? state.employees.filter((e) => e.teamId === team.id).map((e) => e.id) : []);
    setTouched(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team]);
  if (!f) return <Drawer open={false} onClose={onClose} title=""><div /></Drawer>;
  const isNew = !state.teams.some((t) => t.id === f.id);
  const activeEmployees = state.employees.filter((e) => e.status === 'Active');
  // A blank install has no employees yet, so the first team cannot have a lead. The lead
  // is required as soon as there is someone to pick; until then it can be assigned later.
  const leadRequired = activeEmployees.length > 0;
  const errs = {
    name: !f.name.trim() ? 'Enter a team name.' : undefined,
    lead: leadRequired && !f.leadId ? 'Choose a team lead.' : undefined
  };
  const save = async () => {
    setTouched(true);
    if (errs.name || errs.lead) return;
    const all = f.leadId && !members.includes(f.leadId) ? [...members, f.leadId] : members;
    if (await mutate(cmd.saveTeam({ ...f, name: f.name.trim() }, all), isNew ? 'Team created' : 'Team updated')) onClose();
  };
  return (
    <Drawer open onClose={onClose} title={isNew ? 'Create team' : `Edit ${team?.name}`}
    footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={save}>{isNew ? 'Create team' : 'Save changes'}</Button></>}>
      <div className="space-y-4">
        <Field label="Team name" required error={touched ? errs.name : undefined}>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} invalid={touched && !!errs.name} />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Team lead" required={leadRequired} hint={leadRequired ? undefined : 'Add employees first, then assign a lead here.'} error={touched ? errs.lead : undefined}>{(id) => <Select id={id} value={f.leadId} onChange={(e) => setF({ ...f, leadId: e.target.value })} invalid={touched && !!errs.lead}><option value="">{leadRequired ? 'Select lead' : 'No lead yet'}</option>{activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>}</Field>
          <Field label="Status">{(id) => <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Team['status'] })}><option>Active</option><option>Inactive</option></Select>}</Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Members</legend>
          <p className="mb-3 text-xs text-ink-muted">An employee belongs to one team. Adding someone here moves them from their current team.</p>
          <div className="space-y-3 rounded-lg border border-line p-3">
            {activeEmployees.length === 0 && <p className="text-sm text-ink-muted">No employees yet. Add them from the Employees page, then come back to assign members.</p>}
            {activeEmployees.map((e) => {
              const other = e.teamId && e.teamId !== f.id ? state.teams.find((t) => t.id === e.teamId)?.name : undefined;
              return <Checkbox key={e.id} label={e.name} description={`${e.designation}${other ? ` · currently in ${other}` : ''}`} checked={members.includes(e.id)} onChange={(v) => setMembers(v ? [...members, e.id] : members.filter((x) => x !== e.id))} />;
            })}
          </div>
        </fieldset>
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
      </div>
    </Drawer>);

}