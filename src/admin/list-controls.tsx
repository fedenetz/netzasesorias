import { Check, ChevronDown, ChevronUp } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';
export type SortState<Key extends string> = { key: Key; direction: SortDirection };
export type SortValue = string | number | boolean | null | undefined;

export function compareSortValues(left: SortValue, right: SortValue, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1;
  if (left == null || left === '') return right == null || right === '' ? 0 : multiplier;
  if (right == null || right === '') return -multiplier;
  if (typeof left === 'number' && typeof right === 'number') return (left - right) * multiplier;
  if (typeof left === 'boolean' && typeof right === 'boolean') return (Number(left) - Number(right)) * multiplier;
  return String(left).localeCompare(String(right), 'es', { numeric: true, sensitivity: 'base' }) * multiplier;
}

export function nextSort<Key extends string>(current: SortState<Key>, key: Key): SortState<Key> {
  return current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' };
}

export function MultiSelectFilter({ label, allLabel, options, values, onChange }: {
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const selectedLabels = options.filter(option => values.includes(option.value)).map(option => option.label);
  const summary = selectedLabels.length === 0 ? allLabel : selectedLabels.length === 1 ? selectedLabels[0] : `${label} · ${selectedLabels.length}`;
  const toggle = (value: string) => onChange(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  return <details className={`multi-select-filter ${values.length ? 'active' : ''}`}>
    <summary aria-label={label}>{summary}<ChevronDown size={13}/></summary>
    <div className="multi-select-menu">
      <button type="button" className={!values.length ? 'selected' : ''} onClick={() => onChange([])}><span>{!values.length && <Check size={12}/>}</span>{allLabel}</button>
      {options.map(option => <button type="button" className={values.includes(option.value) ? 'selected' : ''} key={option.value} onClick={() => toggle(option.value)}><span>{values.includes(option.value) && <Check size={12}/>}</span>{option.label}</button>)}
    </div>
  </details>;
}

export function SortableHeader<Key extends string>({ label, sort, sortKey, onSort, className }: {
  label: string;
  sort: SortState<Key>;
  sortKey: Key;
  onSort: (key: Key) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return <th className={className} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button className={`sortable-heading ${active ? 'active' : ''}`} type="button" onClick={() => onSort(sortKey)}>{label}{active ? sort.direction === 'asc' ? <ChevronUp size={13}/> : <ChevronDown size={13}/> : <ChevronDown size={13}/>}</button></th>;
}
