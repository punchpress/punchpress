const DEFAULT_HISTORY_LIMIT = 100;

export class HistoryManager {
  constructor({
    applyChange,
    applyState,
    captureState,
    captureSnapshot,
    createChange,
    limit = DEFAULT_HISTORY_LIMIT,
  }) {
    this.applyChange = applyChange;
    this.applyState = applyState;
    this.captureState = captureState;
    this.captureSnapshot = captureSnapshot;
    this.createChange = createChange;
    this.currentRevision = 0;
    this.isApplying = false;
    this.limit = limit;
    this.redoStack = [];
    this.savedSnapshot = captureSnapshot();
    this.transactionState = null;
    this.undoStack = [];
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get isDirty() {
    return this.captureSnapshot() !== this.savedSnapshot;
  }

  beginTransaction() {
    if (this.isApplying || this.transactionState !== null) {
      return;
    }

    this.transactionState = this.captureState();
  }

  endTransaction() {
    if (this.transactionState === null) {
      return false;
    }

    const beforeState = this.transactionState;
    this.transactionState = null;
    return this.recordChange(beforeState);
  }

  markSaved() {
    this.savedSnapshot = this.captureSnapshot();
  }

  recordChange(beforeState) {
    if (this.isApplying) {
      return false;
    }

    const change = this.createChange(beforeState, this.captureState());

    if (!change) {
      return false;
    }

    this.currentRevision += 1;
    this.undoStack.push(change);
    this.trimStack(this.undoStack);
    this.redoStack = [];
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) {
      return false;
    }

    const nextChange = this.redoStack.pop();

    if (!nextChange) {
      return false;
    }

    return this.restoreChange(nextChange, this.undoStack, "redo");
  }

  reset() {
    this.currentRevision = 0;
    this.redoStack = [];
    this.savedSnapshot = this.captureSnapshot();
    this.transactionState = null;
    this.undoStack = [];
  }

  run(runChange) {
    if (this.isApplying || this.transactionState !== null) {
      runChange();
      return;
    }

    const beforeState = this.captureState();
    runChange();
    this.recordChange(beforeState);
  }

  undo() {
    if (this.undoStack.length === 0) {
      return false;
    }

    const previousChange = this.undoStack.pop();

    if (!previousChange) {
      return false;
    }

    return this.restoreChange(previousChange, this.redoStack, "undo");
  }

  restoreChange(change, targetStack, direction) {
    this.isApplying = true;
    this.transactionState = null;

    try {
      const nextState = this.applyChange(
        this.captureState(),
        change,
        direction
      );
      this.applyState(nextState);
      if (direction === "undo") {
        this.currentRevision -= 1;
      } else {
        this.currentRevision += 1;
      }

      targetStack.push(change);
      this.trimStack(targetStack);
      return true;
    } finally {
      this.isApplying = false;
    }
  }

  trimStack(stack) {
    if (stack.length <= this.limit) {
      return;
    }

    stack.splice(0, stack.length - this.limit);
  }
}
