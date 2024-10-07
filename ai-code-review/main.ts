import tl = require('azure-pipelines-task-lib/task');
import { AzureOpenAI } from 'openai';
import { ChatCompletion } from './chatCompletion';
import { Repository } from './repository';
import { PullRequest } from './pullrequest';
import "@azure/openai/types";

export class Main {
    private static _chatCompletion: ChatCompletion;
    private static _repository: Repository;
    private static _pullRequest: PullRequest;

    public static async Main(): Promise<void> {
        if (tl.getVariable('Build.Reason') !== 'PullRequest') {
            tl.setResult(tl.TaskResult.Skipped, "This task must only be used when triggered by a Pull Request.");
            return;
        }

        if(!tl.getVariable('System.AccessToken')) {
            tl.setResult(tl.TaskResult.Failed, "'Allow Scripts to Access OAuth Token' must be enabled. See https://learn.microsoft.com/en-us/azure/devops/pipelines/build/options?view=azure-devops#allow-scripts-to-access-the-oauth-token for more information");
            return;
        }

        const endpointUrl = tl.getInput('azureOpenAiDeploymentEndpointUrl', true)!;
        const apiKey = tl.getInput('azureOpenAiApiKey', true)!;
        const apiVersion = tl.getInput('azureOpenAiApiVersion', true)!;
        const fileExtensions = tl.getInput('fileExtensions', false);
        const filesToExclude = tl.getInput('fileExcludes', false);
        const additionalPrompts = tl.getInput('additionalPrompts', false)?.split(',')
        const promptTokensPricePerToken = parseFloat(tl.getInput('promptTokensPricePerToken', false) ?? '0.');
        const completionTokensPricePerToken = parseFloat(tl.getInput('completionTokensPricePerToken', false) ?? '0.');

        const client = new AzureOpenAI({
            endpoint: endpointUrl,
            apiKey: apiKey,
            apiVersion: apiVersion
        });
        
        this._chatCompletion = new ChatCompletion(client, tl.getBoolInput('bugs', true), tl.getBoolInput('performance', true), tl.getBoolInput('best_practices', true), additionalPrompts);
        this._repository = new Repository();
        this._pullRequest = new PullRequest();

        await this._pullRequest.DeleteComments();

        let filesToReview = await this._repository.GetChangedFiles(fileExtensions, filesToExclude);

        tl.setProgress(0, 'Performing Code Review');
        let promptTokensTotal = 0;
        let completionTokensTotal = 0;
        for (let index = 0; index < filesToReview.length; index++) {
            const fileToReview = filesToReview[index];
            let diff = await this._repository.GetDiff(fileToReview);
            let review = await this._chatCompletion.PerformCodeReview(diff, fileToReview);
            promptTokensTotal += review.promptTokens;
            completionTokensTotal += review.completionTokens;

            if(review.response.indexOf('NO_COMMENT') < 0) {
                await this._pullRequest.AddComment(fileToReview, review.response);
            }

            console.info(`Completed review of file ${fileToReview}`)

            tl.setProgress((fileToReview.length / 100) * index, 'Performing Code Review');
        }

        if(promptTokensPricePerToken !== 0 || completionTokensPricePerToken !== 0) {
            let promptTokensCost = promptTokensTotal * promptTokensPricePerToken;
            let completionTokensCost = completionTokensTotal * completionTokensPricePerToken;
            console.info(`Prompt Tokens Cost: ${promptTokensCost}, Completion Tokens Cost: ${completionTokensCost}`);
            console.info(`Total Prompt Tokens: ${promptTokensTotal}, Total Completion Tokens: ${completionTokensTotal}, Total Cost: ${promptTokensCost + completionTokensCost}`);
        }
        tl.setResult(tl.TaskResult.Succeeded, "Pull Request reviewed.");
    }
}

Main.Main();