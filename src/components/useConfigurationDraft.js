import { useEffect, useState } from 'react';

export default function useConfigurationDraft(source, fromSource, storedDraft, onChange) {
  const [localDraft, setLocalDraft] = useState(() => fromSource(source));
  useEffect(() => { setLocalDraft(fromSource(source)); }, [source, fromSource]);
  const draft = storedDraft ?? localDraft;
  const setDraft = (next) => {
    const value = typeof next === 'function' ? next(draft) : next;
    setLocalDraft(value);
    if (onChange) onChange(value);
  };
  return [draft, setDraft];
}
