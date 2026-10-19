import { describe, it, expect, vi, beforeEach } from 'vitest';
import inquirer from 'inquirer';
import { runInteractiveCli } from '../src/interactive.js';

describe('runInteractiveCli', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize and exit cleanly when exit action is selected', async () => {
    const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ action: 'exit' });

    await runInteractiveCli({ host: 'http://localhost:4000', apiKey: 'test-key' });

    expect(promptSpy).toHaveBeenCalledTimes(1);
    const questions = promptSpy.mock.calls[0][0] as any[];
    expect(questions[0].type).toBe('select');
    expect(questions[0].name).toBe('action');
  });

  it('should list scenarios and then exit', async () => {
    const promptSpy = vi
      .spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ action: 'list-scenarios' })
      .mockResolvedValueOnce({ action: 'exit' });

    await runInteractiveCli();

    expect(promptSpy).toHaveBeenCalledTimes(2);
  });
});
