import type { Project } from '../types';
import { todayKey } from './time';

/** The id of the system learning project. It is never deleted, only edited. */
export const LEARNING_PROJECT_ID = 'p-learning';

/** The code of the system learning project. */
export const LEARNING_PROJECT_CODE = 'LEARN';

/**
 * The system learning project.
 *
 * Every employee can log learning time here even when no work task is assigned to
 * them, and the tasks they create inside it stay visible to the whole company.
 * It behaves like any other project — management can rename it, describe it and
 * change its dates — but it always stays open to everyone.
 */
export function learningProject(now: number = Date.now()): Project {
  return {
    id: LEARNING_PROJECT_ID,
    name: 'Learning & Development',
    code: LEARNING_PROJECT_CODE,
    description:
      'Company-wide space for self-directed learning. Any employee can log learning time here, and the learning tasks created are shared with everyone.',
    client: '',
    managerId: '',
    teamIds: [],
    employeeIds: [],
    startDate: todayKey(now),
    endDate: '2099-12-31',
    status: 'Active',
    availableToAll: true,
    kind: 'Learning',
    notes: 'System project — always available to every employee.'
  };
}

/** Is this the system learning project? */
export const isLearningProject = (project: {id: string;kind?: string;}): boolean =>
  project.id === LEARNING_PROJECT_ID || project.kind === 'Learning';
