import { useState } from 'react';
import type { IssueDraft } from '../types/bugTracker';

export type IssueFormErrors = Partial<Record<keyof IssueDraft, string>>;

export const emptyDraft: IssueDraft = {
  title: '',
  description: '',
  projectId: '',
  type: '',
  severity: '',
  priority: '',
  feature: '',
  environment: '',
  stepsToReproduce: '',
  expectedResult: '',
  actualResult: '',
  labels: [],
  assigneeId: '',
  dueDate: '',
  attachments: []
};

const requiredFields: {key: keyof IssueDraft;message: string;}[] = [
{ key: 'title', message: 'Add a short, specific title.' },
{ key: 'projectId', message: 'Choose the affected project.' },
{ key: 'type', message: 'Choose an issue type.' },
{ key: 'severity', message: 'Choose how severe the impact is.' },
{ key: 'priority', message: 'Choose a priority.' },
{ key: 'environment', message: 'Choose where this happened.' },
{ key: 'description', message: 'Describe what is going wrong.' },
{ key: 'stepsToReproduce', message: 'List the steps to reproduce.' },
{ key: 'expectedResult', message: 'Describe what should happen.' },
{ key: 'actualResult', message: 'Describe what actually happens.' }];


export function validateDraft(draft: IssueDraft): IssueFormErrors {
  const errors: IssueFormErrors = {};
  requiredFields.forEach(({ key, message }) => {
    const value = draft[key];
    if (typeof value === 'string' && !value.trim()) errors[key] = message;
  });
  if (draft.title.trim() && draft.title.trim().length < 10) errors.title = 'Title should be at least 10 characters.';
  if (draft.description.trim() && draft.description.trim().length < 20) errors.description = 'Add a bit more detail (at least 20 characters).';
  return errors;
}

export function useIssueForm(initialProjectId: string) {
  const [draft, setDraft] = useState<IssueDraft>({ ...emptyDraft, projectId: initialProjectId });
  const [errors, setErrors] = useState<IssueFormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const setField = <K extends keyof IssueDraft,>(key: K, value: IssueDraft[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (submitted) setErrors(validateDraft(next));
      return next;
    });
  };

  const validate = () => {
    const result = validateDraft(draft);
    setErrors(result);
    setSubmitted(true);
    return result;
  };

  const reset = (projectId: string) => {
    setDraft({ ...emptyDraft, projectId });
    setErrors({});
    setSubmitted(false);
  };

  return { draft, errors, setField, validate, reset };
}