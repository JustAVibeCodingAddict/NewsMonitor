/**
 * Texto de um registro como ele fica no arquivo: JSON com recuo de 2 espaços e
 * uma quebra de linha no final. A ordem dos campos é a do próprio objeto, que
 * segue a ordem das tabelas em docs/data-model.md. Assim, duas gravações do
 * mesmo registro geram exatamente o mesmo texto e o histórico do Git só mostra
 * o que realmente mudou.
 */
export function serializeRecord(record: unknown): string {
  const text = JSON.stringify(record, null, 2);
  if (text === undefined) {
    throw new TypeError("O registro não pode ser convertido para JSON");
  }
  return `${text}\n`;
}
