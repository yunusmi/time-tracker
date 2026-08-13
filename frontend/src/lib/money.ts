/** «12 500 ₽» — денежный формат как в дизайне. */
export function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}
