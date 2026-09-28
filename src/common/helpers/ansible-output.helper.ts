// ansible.builtin.command doesn't print its own stdout to the
// ansible-playbook console — only the human-readable PLAY/TASK/RECAP report.
// A playbook that needs its command's real output back has to register it
// and echo it via ansible.builtin.debug, which the default callback renders
// as `"msg": "<value>"` inside a pretty-printed JSON block. This extracts
// that value back out of the full ansible-playbook stdout.
export function extractAnsibleDebugMessage(stdout: string): string | null {
  const match = stdout.match(/"msg":\s*"((?:\\.|[^"\\])*)"/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return null;
  }
}
