import tl = require('azure-pipelines-task-lib/task');
import { encode } from 'gpt-tokenizer';
import OpenAI, { AzureOpenAI } from 'openai';

export class ChatCompletion {
    private readonly systemMessage: string = '';

    constructor(
        private _openAi: AzureOpenAI, 
        checkForBugs: boolean = false,
        checkForPerformance: boolean = false,
        checkForBestPractices: boolean = false,
        additionalPrompts: string[] = [],
        private _maxTokens: number = 16384,
        numberOfFilesToReview: number = 1
     ) {
        this.systemMessage = `Your task is to act as a code reviewer of a Pull Request:
        ${numberOfFilesToReview > 1 ? '- Generate high-level summary and a technical walkthrough of all pull request changes' : null}
        ${checkForBugs ? '- If there are any bugs, highlight them.' : null}
        ${checkForPerformance ? '- If there are major performance problems, highlight them.' : null}
        ${checkForBestPractices ? '- Provide details on missed use of best-practices.' : null}
        ${additionalPrompts.length > 0 ? additionalPrompts.map(str => `- ${str}`).join('\n') : null}
        - Do not highlight minor issues and nitpicks.
        - Only provide instructions for improvements.
        - If you have no specific instructions for a certain topic, then do not mention the topic at all.
        - If you have no instructions for code then respond with NO_COMMENT only, otherwise provide your instructions.
    
        You are provided with the code changes (diffs) in a unidiff format.
        
        The response should be in markdown format:
        - Use bullet points if you have multiple comments. Utilize emojis to make your comments more engaging.
        - Use the code block syntax for larger code snippets but do not wrap the whole response in a code block
        - Use inline code syntax for smaller inline code snippets
`
        if (numberOfFilesToReview > 1) {
            this.systemMessage += `
        Create table that lists the files and their respective comments. For example:

        Summary of changes: ...

        Feedback on files:
        | File Name | Comments |
        | --- | --- |
        | file1.cs | - comment1 |
        | file2.js | - comment2<br>- comment3 |
        | file3.py | No comments |
        | styles.css | - comment4 |
`}
    }

    public async PerformCodeReview(diff: string, fileName: string): 
            Promise<{response: string, promptTokens: number, completionTokens: number}> {

        if (!this.doesMessageExceedTokenLimit(diff + this.systemMessage, this._maxTokens)) {

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

        tl.warning(`Unable to process diff for ${fileName} as it exceeds token limits.`)
        return {response: '', promptTokens: 0, completionTokens: 0};
    }

    private doesMessageExceedTokenLimit(message: string, tokenLimit: number): boolean {
        let tokens = encode(message);
        return tokens.length > tokenLimit;
    }

}
