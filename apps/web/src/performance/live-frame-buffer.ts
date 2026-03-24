export class LiveFrameBuffer<TValue> {
  private readonly capacity: number;
  private readonly entries: Array<TValue | undefined>;
  private head = 0;
  private size = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.entries = new Array<TValue | undefined>(capacity);
  }

  append = (value: TValue) => {
    if (this.capacity <= 0) {
      return undefined;
    }

    if (this.size < this.capacity) {
      const tailIndex = (this.head + this.size) % this.capacity;
      this.entries[tailIndex] = value;
      this.size += 1;
      return undefined;
    }

    const evictedValue = this.entries[this.head];
    this.entries[this.head] = value;
    this.head = (this.head + 1) % this.capacity;

    return evictedValue;
  };

  clear = () => {
    this.head = 0;
    this.size = 0;
    this.entries.fill(undefined);
  };

  toArray = () => {
    if (this.size === 0) {
      return [];
    }

    if (this.size < this.capacity) {
      return this.entries.slice(0, this.size) as TValue[];
    }

    return [
      ...(this.entries.slice(this.head) as TValue[]),
      ...(this.entries.slice(0, this.head) as TValue[]),
    ];
  };
}
