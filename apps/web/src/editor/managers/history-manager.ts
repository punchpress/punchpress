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
    this.activeMarks = new Map();
    this.captureState = captureState;
    this.captureSnapshot = captureSnapshot;
    this.createChange = createChange;
    this.currentRevision = 0;
    this.isApplying = false;
    this.limit = limit;
    this.nextMarkId = 0;
    this.redoStack = [];
    this.savedSnapshot = captureSnapshot();
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

  markSaved() {
    this.savedSnapshot = this.captureSnapshot();
  }

  mark(name) {
    if (this.isApplying) {
      return null;
    }

    const mark = {
      beforeState: this.captureState(),
      id: this.nextMarkId,
      name: name || null,
      revision: this.currentRevision,
    };

    this.nextMarkId += 1;
    this.activeMarks.set(mark.id, mark);
    return mark;
  }

  commitMark(mark) {
    if (!this.releaseMark(mark) || this.isApplying) {
      return false;
    }

    return this.pushChange(mark.beforeState);
  }

  revertToMark(mark) {
    if (!this.releaseMark(mark) || this.isApplying) {
      return false;
    }

    this.applyState(mark.beforeState);
    return true;
  }

  pushChange(beforeState) {
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
    this.activeMarks.clear();
    this.currentRevision = 0;
    this.redoStack = [];
    this.savedSnapshot = this.captureSnapshot();
    this.undoStack = [];
  }

  run(runChange) {
    if (this.isApplying || this.activeMarks.size > 0) {
      runChange();
      return;
    }

    const beforeState = this.captureState();
    runChange();
    this.pushChange(beforeState);
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
    this.activeMarks.clear();

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

  releaseMark(mark) {
    if (!(mark && this.activeMarks.has(mark.id))) {
      return null;
    }

    this.activeMarks.delete(mark.id);
    return mark;
  }
}
