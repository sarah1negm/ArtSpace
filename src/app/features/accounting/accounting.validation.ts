import {
  isAmount,
  isDate,
  isRecord,
  isText,
  uniqueIds,
} from '../../core/services/storage-validation';
import { AccountingState, Adjustment, LedgerEntry, StaffMember } from './accounting.models';

const adjustments = (value: unknown): value is Adjustment[] =>
  Array.isArray(value) &&
  value.every(
    (item): item is Adjustment =>
      isRecord(item) && isText(item['id']) && isText(item['label']) && isAmount(item['amount']),
  ) &&
  uniqueIds(value);

export function isAccountingState(value: unknown): value is AccountingState {
  if (
    !isRecord(value) ||
    !Array.isArray(value['staff']) ||
    !Array.isArray(value['ledger']) ||
    !isRecord(value['paid'])
  )
    return false;
  const staff = value['staff'];
  const ledger = value['ledger'];
  return (
    staff.every(
      (item): item is StaffMember =>
        isRecord(item) &&
        isText(item['id']) &&
        isText(item['name']) &&
        ['Teacher', 'Staff'].includes(item['role'] as string) &&
        isText(item['title']) &&
        isAmount(item['baseSalary']) &&
        adjustments(item['allowances']) &&
        adjustments(item['deductions']),
    ) &&
    uniqueIds(staff) &&
    ledger.every(
      (item): item is LedgerEntry =>
        isRecord(item) &&
        isText(item['id']) &&
        typeof item['month'] === 'string' &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(item['month']) &&
        ['income', 'expense'].includes(item['type'] as string) &&
        isText(item['label']) &&
        isAmount(item['amount']),
    ) &&
    uniqueIds(ledger) &&
    Object.values(value['paid']).every(isDate)
  );
}
