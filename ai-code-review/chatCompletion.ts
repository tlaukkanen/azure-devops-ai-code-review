import tl = require('azure-pipelines-task-lib/task');
import { encode } from 'gpt-tokenizer';
import OpenAI, { AzureOpenAI } from 'openai';

export class ChatCompletion {
    private readonly systemMessage: string = '';

    constructor(private _openAi: AzureOpenAI, checkForBugs: boolean = false, checkForPerformance: boolean = false, checkForBestPractices: boolean = false, additionalPrompts: string[] = []) {
        this.systemMessage = `Your task is to act as a code reviewer of a Pull Request:
        - Use bullet points with emojis if you have multiple comments.
        ${checkForBugs ? '- 🐛 If there are any bugs, highlight them.' : null}
        ${checkForPerformance ? '- 🏎️ If there are major performance problems, highlight them.' : null}
        ${checkForBestPractices ? '- 📓 Provide details on missed use of best-practices.' : null}
        ${additionalPrompts.length > 0 ? additionalPrompts.map(str => `- ${str}`).join('\n') : null}
        - Do not highlight minor issues and nitpicks.
        - Only provide instructions for improvements 
        - If you have no instructions respond with NO_COMMENT only, otherwise provide your instructions.
    
        You are provided with the code changes (diffs) in a unidiff format.
        
        The response should be in markdown format.`
    }

    public async PerformCodeReview(diff: string, fileName: string): 
            Promise<{response: string, promptTokens: number, completionTokens: number}> {

        if (!this.doesMessageExceedTokenLimit(diff + this.systemMessage, 4097)) {

            let openAi = await this._openAi.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: this.systemMessage
                    },
                    {
                        role: 'user',
                        content: diff
                    },
                ],
                model: ''
            });

            let response = openAi.choices;
            const tokenUsage = openAi.usage;
            const tokenUsageString = JSON.stringify(tokenUsage);
            console.info(`Usage: ${tokenUsageString}`);

            if (response.length > 0) {
                return {
                    response: response[0].message.content!,
                    promptTokens: tokenUsage!.prompt_tokens,
                    completionTokens: tokenUsage!.completion_tokens,
                };
            }
        }

        tl.warning(`Unable to process diff for file ${fileName} as it exceeds token limits.`)
        return {response: '', promptTokens: 0, completionTokens: 0};
    }

    private doesMessageExceedTokenLimit(message: string, tokenLimit: number): boolean {
        let tokens = encode(message);
        return tokens.length > tokenLimit;
    }

}
