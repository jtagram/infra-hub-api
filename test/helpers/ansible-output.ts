/**
 * Realistic ansible-playbook stdout fixtures. The service code only parses the
 * pretty-printed `=> {...}` task-result blocks, so these reproduce the default
 * callback layout (PLAY / TASK banners, host lines, PLAY RECAP).
 */
const HOST = 'pcbox.test';

function pretty(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 4);
}

function recap(result: 'ok' | 'failed'): string {
  const counters =
    result === 'ok'
      ? 'ok=2    changed=1    unreachable=0    failed=0    skipped=0'
      : 'ok=0    changed=0    unreachable=0    failed=1    skipped=0';
  return `\nPLAY RECAP *********************************************************************\n${HOST}                : ${counters}\n`;
}

/** Playbook that registered a command and echoed its stdout through debug/msg. */
export function ansibleDebugOutput(commandTaskName: string, msg: string) {
  return [
    'PLAY [all] *********************************************************************',
    '',
    `TASK [${commandTaskName}] ${'*'.repeat(40)}`,
    `changed: [${HOST}]`,
    '',
    'TASK [Emit output] *************************************************************',
    `ok: [${HOST}] => ${pretty({ msg })}`,
    recap('ok'),
  ].join('\n');
}

/** Playbook with a single command task that succeeded (command prints nothing). */
export function ansibleChangedOutput(taskName: string) {
  return [
    'PLAY [all] *********************************************************************',
    '',
    `TASK [${taskName}] ${'*'.repeat(40)}`,
    `changed: [${HOST}]`,
    recap('ok'),
  ].join('\n');
}

/** Fatal task result, as ansible prints a failing `ansible.builtin.command`. */
export function ansibleFatalOutput(
  taskName: string,
  fields: { stderr?: string; msg?: string },
) {
  return [
    'PLAY [all] *********************************************************************',
    '',
    `TASK [${taskName}] ${'*'.repeat(40)}`,
    `fatal: [${HOST}]: FAILED! => ${pretty({
      changed: true,
      msg: fields.msg ?? 'non-zero return code',
      rc: 1,
      ...(fields.stderr === undefined ? {} : { stderr: fields.stderr }),
      stdout: '',
    })}`,
    recap('failed'),
  ].join('\n');
}
