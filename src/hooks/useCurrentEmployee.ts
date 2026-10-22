import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import type { Employee } from '@shared/types';

export function useCurrentEmployee(): Employee {
  const { user } = useAuth();
  const { state } = useData();
  const emp = state.employees.find((e) => e.id === user?.employeeId);
  if (!emp) throw new Error('Signed-in employee record not found');
  return emp;
}