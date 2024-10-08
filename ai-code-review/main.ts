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
        const promptTokensPricePerMillionTokens = parseFloat(tl.getInput('promptTokensPricePerMillionTokens', false) ?? '0.');
        const completionTokensPricePerMillionTokens = parseFloat(tl.getInput('completionTokensPricePerMillionTokens', false) ?? '0.');
        const maxTokens = parseInt(tl.getInput('maxTokens', false) ?? '16384');
        const reviewWholeDiffAtOnce = tl.getBoolInput('reviewWholeDiffAtOnce', false);
        const addCostToComments = tl.getBoolInput('addCostToComments', false);

        const client = new AzureOpenAI({
            endpoint: endpointUrl,
            apiKey: apiKey,
            apiVersion: apiVersion
        });
        
        this._repository = new Repository();
        this._pullRequest = new PullRequest();
        let filesToReview = await this._repository.GetChangedFiles(fileExtensions, filesToExclude);

        this._chatCompletion = new ChatCompletion(
            client,
            tl.getBoolInput('reviewBugs', true),
            tl.getBoolInput('reviewPerformance', true),
            tl.getBoolInput('reviewBestPractices', true),
            additionalPrompts,
            maxTokens,
            filesToReview.length
        );

        await this._pullRequest.DeleteComments();

        tl.setProgress(0, 'Performing Code Review');
        let promptTokensTotal = 0;
        let completionTokensTotal = 0;
        let fullDiff = '';
        for (let index = 0; index < filesToReview.length; index++) {
            const fileToReview = filesToReview[index];
            let diff = await this._repository.GetDiff(fileToReview);
            if(!reviewWholeDiffAtOnce) {
                let review = await this._chatCompletion.PerformCodeReview(diff, fileToReview);
                promptTokensTotal += review.promptTokens;
                completionTokensTotal += review.completionTokens;

                if(review.response.indexOf('NO_COMMENT') < 0) {
                    console.info(`Completed review of file ${fileToReview}`)
                    await this._pullRequest.AddComment(fileToReview, review.response);
                } else {
                    console.info(`No comments for file ${fileToReview}`)
                }

                tl.setProgress((fileToReview.length / 100) * index, 'Performing Code Review');
            } else {
                fullDiff += diff;
            }
        }
        if(reviewWholeDiffAtOnce) {
            let review = await this._chatCompletion.PerformCodeReview(fullDiff, 'Full Diff');
            promptTokensTotal += review.promptTokens;
            completionTokensTotal += review.completionTokens;

            let comment = review.response;
            if(addCostToComments) {
                const promptTokensCost = promptTokensTotal * (promptTokensPricePerMillionTokens / 1000000);
                const completionTokensCost = completionTokensTotal * (completionTokensPricePerMillionTokens / 1000000);
                const totalCostString = (promptTokensCost + completionTokensCost).toFixed(6);
                comment += `\n\n💰 _It cost $${totalCostString} to create this review_`;
            }

            if(review.response.indexOf('NO_COMMENT') < 0) {
                console.info(`Completed review for ${filesToReview.length} files`)
                await this._pullRequest.AddComment("", comment);
            } else {
                console.info(`No comments for full diff`)
            }
        }

        if(promptTokensPricePerMillionTokens !== 0 || completionTokensPricePerMillionTokens !== 0) {
            const promptTokensCost = promptTokensTotal * (promptTokensPricePerMillionTokens / 1000000);
            const completionTokensCost = completionTokensTotal * (completionTokensPricePerMillionTokens / 1000000);
            const totalCostString = (promptTokensCost + completionTokensCost).toFixed(6);
            console.info(`--- Cost Analysis ---`);
            console.info(`🪙 Total Prompt Tokens     : ${promptTokensTotal}`);
            console.info(`🪙 Total Completion Tokens : ${completionTokensTotal}`); 
            console.info(`💵 Input Tokens Cost       : ${promptTokensCost.toFixed(6)} $`);
            console.info(`💵 Output Tokens Cost      : ${completionTokensCost.toFixed(6)} $`);
            console.info(`💰 Total Cost              : ${totalCostString} $`);
        }
        tl.setResult(tl.TaskResult.Succeeded, "Pull Request reviewed.");
    }
}

Main.Main();