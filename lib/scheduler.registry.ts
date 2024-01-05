import { Injectable, Logger } from '@nestjs/common';
import type { CronJob, CronOnCompleteCommand } from 'cron';
import { DUPLICATE_SCHEDULER, NO_SCHEDULER_FOUND } from './schedule.messages';

@Injectable()
export class SchedulerRegistry<
  OC extends CronOnCompleteCommand | null = null,
  C = null,
> {
  private readonly logger = new Logger(SchedulerRegistry.name);

  private readonly cronJobs = new Map<string, CronJob<OC, C>>();
  private readonly timeouts = new Map<string, any>();
  private readonly intervals = new Map<string, any>();

  doesExist(type: 'cron' | 'timeout' | 'interval', name: string) {
    switch (type) {
      case 'cron':
        return this.cronJobs.has(name);
      case 'interval':
        return this.intervals.has(name);
      case 'timeout':
        return this.timeouts.has(name);
      default:
        return false;
    }
  }

  getCronJob(name: string) {
    const ref = this.cronJobs.get(name);
    if (!ref) {
      throw new Error(NO_SCHEDULER_FOUND('Cron Job', name));
    }
    return ref;
  }

  getInterval(name: string) {
    const ref = this.intervals.get(name);
    if (typeof ref === 'undefined') {
      throw new Error(NO_SCHEDULER_FOUND('Interval', name));
    }
    return ref;
  }

  getTimeout(name: string) {
    const ref = this.timeouts.get(name);
    if (typeof ref === 'undefined') {
      throw new Error(NO_SCHEDULER_FOUND('Timeout', name));
    }
    return ref;
  }

  addCronJob(name: string, job: CronJob<OC, C>) {
    const ref = this.cronJobs.get(name);
    if (ref) {
      throw new Error(DUPLICATE_SCHEDULER('Cron Job', name));
    }

    job.fireOnTick = this.wrapFunctionInTryCatchBlocks(job.fireOnTick, job);
    this.cronJobs.set(name, job);
  }

  addInterval<T = any>(name: string, intervalId: T) {
    const ref = this.intervals.get(name);
    if (ref) {
      throw new Error(DUPLICATE_SCHEDULER('Interval', name));
    }
    this.intervals.set(name, intervalId);
  }

  addTimeout<T = any>(name: string, timeoutId: T) {
    const ref = this.timeouts.get(name);
    if (ref) {
      throw new Error(DUPLICATE_SCHEDULER('Timeout', name));
    }
    this.timeouts.set(name, timeoutId);
  }

  getCronJobs(): Map<string, CronJob<OC, C>> {
    return this.cronJobs;
  }

  deleteCronJob(name: string) {
    const cronJob = this.getCronJob(name);
    cronJob.stop();
    this.cronJobs.delete(name);
  }

  getIntervals(): string[] {
    return [...this.intervals.keys()];
  }

  deleteInterval(name: string) {
    const interval = this.getInterval(name);
    clearInterval(interval);
    this.intervals.delete(name);
  }

  getTimeouts(): string[] {
    return [...this.timeouts.keys()];
  }

  deleteTimeout(name: string) {
    const timeout = this.getTimeout(name);
    clearTimeout(timeout);
    this.timeouts.delete(name);
  }

  private wrapFunctionInTryCatchBlocks(
    methodRef: Function,
    instance: object,
  ): (...args: unknown[]) => Promise<void> {
    return async (...args: unknown[]) => {
      try {
        await methodRef.call(instance, ...args);
      } catch (error) {
        this.logger.error(error);
      }
    };
  }
}
