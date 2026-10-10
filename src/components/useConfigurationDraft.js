import { useEffect, useState } from 'react';

export default function useConfigurationDraft(source, fromSource, storedDraft, onChange) {
  const [localDraft, setLocalDraft] = useState(() => fromSource(source));
  const [editError, setEditError] = useState(null);
  useEffect(() => { setLocalDraft(fromSource(source)); setEditError(null); }, [source, fromSource]);
  const draft = storedDraft ?? localDraft;
  const setDraft = (next) => {
    const value = typeof next === 'function' ? next(draft) : next;
    try {
      const result = onChange ? onChange(value) : undefined;
      if (result?.ok === false) {
        setEditError(result.code || 'INVALID_VALUATION_EDITOR_DRAFT');
        return false;
      }
      setLocalDraft(value);
      setEditError(null);
      return true;
    } catch (error) {
      setEditError(error.code || 'INVALID_VALUATION_EDITOR_DRAFT');
      return false;
    }
  };
  return [draft, setDraft, editError];
}
