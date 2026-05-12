type Task = {
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export class RequestQueue {
  private readonly concurrency: number;
  private activeCount = 0;
  private readonly pending: Task[] = [];

  constructor(concurrency: number) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error("RequestQueue concurrency must be a positive integer");
    }

    this.concurrency = concurrency;
  }

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        run: () => run(),
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.flush();
    });
  }

  private flush(): void {
    while (this.activeCount < this.concurrency) {
      const next = this.pending.shift();

      if (!next) {
        return;
      }

      this.activeCount += 1;

      void next
        .run()
        .then(next.resolve, next.reject)
        .finally(() => {
          this.activeCount -= 1;
          this.flush();
        });
    }
  }
}
