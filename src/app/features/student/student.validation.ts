import {
  isAmount,
  isDate,
  isRecord,
  isText,
  uniqueIds,
} from '../../core/services/storage-validation';
import { Artwork, Invoice, StudentRecords } from './student.models';
import { FEES } from './student.mock';

export function isStudentRecords(value: unknown): value is StudentRecords {
  if (!isRecord(value) || !Array.isArray(value['invoices']) || !Array.isArray(value['artworks']))
    return false;
  const invoices = value['invoices'];
  const artworks = value['artworks'];
  return (
    invoices.every(
      (item): item is Invoice =>
        isRecord(item) &&
        isText(item['id']) &&
        FEES.some((fee) => fee.id === item['feeId']) &&
        isDate(item['issuedOn']) &&
        (item['paidOn'] === null || isDate(item['paidOn'])),
    ) &&
    uniqueIds(invoices) &&
    new Set(invoices.map((item) => item.feeId)).size === invoices.length &&
    artworks.every(
      (item): item is Artwork =>
        isRecord(item) &&
        isText(item['id']) &&
        isText(item['title']) &&
        isText(item['description']) &&
        isText(item['imageUrl']) &&
        ['Painting', 'Print', 'Other'].includes(item['category'] as string) &&
        isAmount(item['price']) &&
        item['price'] > 0,
    ) &&
    uniqueIds(artworks)
  );
}
