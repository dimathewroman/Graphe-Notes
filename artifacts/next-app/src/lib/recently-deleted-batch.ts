export async function deleteRecentlyDeletedBatch(
  noteIds: number[],
  deleteOne: (noteId: number) => Promise<void>,
  reconcileSuccess: (noteId: number) => Promise<void>,
): Promise<void> {
  for (const noteId of noteIds) {
    await deleteOne(noteId);
    await reconcileSuccess(noteId);
  }
}
