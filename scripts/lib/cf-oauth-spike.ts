import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export async function acquireCfOAuthSpikeLock(options?: {
  lockFilePath?: string;
}) {
  const lockFilePath =
    options?.lockFilePath ||
    path.resolve(
      process.cwd(),
      '.gstack/projects/Larrybin-aooi/cf-oauth-spike.lock'
    );
  await mkdir(path.dirname(lockFilePath), { recursive: true });

  const openLockFile = async () => await open(lockFilePath, 'wx');
  let handle;

  try {
    handle = await openLockFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') {
      throw error;
    }

    const staleLockRecovered = await recoverStaleLock(lockFilePath);
    if (!staleLockRecovered) {
      throw new Error(
        `pnpm test:cf-oauth-spike 已在运行，请等待当前进程结束后重试（lock: ${lockFilePath}）`
      );
    }

    handle = await openLockFile();
  }

  await handle.writeFile(`${process.pid}\n`, 'utf8');

  let released = false;

  return {
    lockFilePath,
    async release() {
      if (released) {
        return;
      }

      released = true;
      await handle.close();
      await unlink(lockFilePath).catch((error) => {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw error;
        }
      });
    },
  };
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const errno = (error as NodeJS.ErrnoException)?.code;
    if (errno === 'EPERM') {
      return true;
    }

    if (errno === 'ESRCH') {
      return false;
    }

    throw error;
  }
}

async function recoverStaleLock(lockFilePath: string) {
  let lockContent = '';

  try {
    lockContent = await readFile(lockFilePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return true;
    }

    throw error;
  }

  const existingPid = Number.parseInt(lockContent.trim(), 10);
  if (Number.isFinite(existingPid) && existingPid > 0) {
    if (isProcessAlive(existingPid)) {
      return false;
    }
  }

  await unlink(lockFilePath).catch((error) => {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw error;
    }
  });

  return true;
}
