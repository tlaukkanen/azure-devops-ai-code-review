import * as tl from "azure-pipelines-task-lib/task";
import { Agent } from "https";
import fetch from 'node-fetch';

export class PullRequest {
    private _httpsAgent: Agent;

    private _collectionUri: string = tl.getVariable('System.TeamFoundationCollectionUri')!;
    private _teamProjectId: string = tl.getVariable('System.TeamProjectId')!;
    private _repositoryName: string = tl.getVariable('Build.Repository.Name')!;
    private _pullRequestId: string = tl.getVariable('System.PullRequest.PullRequestId')!;

    constructor() {
        this._httpsAgent = new Agent({
            rejectUnauthorized: false
        });
    }

    public async AddComment(fileName: string, comment: string): Promise<boolean> {

        console.info(`Comment added to ${fileName}`);

        if (!fileName.startsWith('/')) {
            fileName = `/${fileName}`;
        }
        
        let body = {
            comments: [
                {
                    content: comment,
                    commentType: 2
                }
            ],
            status: 1,
            // Don't provide filename if we are commenting on the whole PR
            threadContext: fileName.length > 0 ? {
                filePath: fileName
            } : null,
            pullRequestThreadContext: {
                changeTrackingId: 1,
                iterationContext: {
                    firstComparingIteration: 1,
                    secondComparingIteration: 2
                }
            }
        }

        let endpoint = `${this._collectionUri}${this._teamProjectId}/_apis/git/repositories/${this._repositoryName}/pullRequests/${this._pullRequestId}/threads?api-version=7.0`

        var response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tl.getVariable('SYSTEM.ACCESSTOKEN')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            agent: this._httpsAgent
        });

        if (response.ok == false) {
            if(response.status == 401) {
                tl.setResult(tl.TaskResult.Failed, "The Build Service must have 'Contribute to pull requests' access to the repository. See https://stackoverflow.com/a/57985733 for more information");
            }

            tl.warning(response.statusText)
        }

        return response.ok;
    }

    public async DeleteComment(thread: any, comment: any): Promise<boolean> {
        let removeCommentUrl = `${this._collectionUri}${this._teamProjectId}/_apis/git/repositories/${this._repositoryName}/pullRequests/${this._pullRequestId}/threads/${thread.id}/comments/${comment.id}?api-version=5.1`;

        let response = await fetch(removeCommentUrl, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tl.getVariable('System.AccessToken')}`, 'Content-Type': 'application/json' },
            agent: this._httpsAgent
        });

        if (response.ok == false) {
            tl.warning(`Failed to delete comment from url ${removeCommentUrl} the response was ${response.statusText}`);
        }

        return response.ok;
    }

    public async DeleteComments() {
        let collectionName = this._collectionUri.replace('https://', '').replace('http://', '').split('/')[1];
        let buildServiceName = `${tl.getVariable('SYSTEM.TEAMPROJECT')} Build Service (${collectionName})`;

        let threads = await this.GetThreads();

        for (let thread of threads as any[]) {
            let comments = await this.GetComments(thread);

            for (let comment of comments.value.filter((comment: any) => comment.author.displayName === buildServiceName) as any[]) {
                await this.DeleteComment(thread, comment);
            }
        }
    }

    public async GetThreads(): Promise<never[]> {
        let threadsEndpoint = `${this._collectionUri}${this._teamProjectId}/_apis/git/repositories/${this._repositoryName}/pullRequests/${this._pullRequestId}/threads?api-version=5.1`;
        let threadsResponse = await fetch(threadsEndpoint, {
            headers: { 'Authorization': `Bearer ${tl.getVariable('System.AccessToken')}`, 'Content-Type': 'application/json' },
            agent: this._httpsAgent
        });

        if (threadsResponse.ok == false) {
            tl.warning(`Failed to retrieve threads from url ${threadsEndpoint} the response was ${threadsResponse.statusText}`);
        }

        let threads = await threadsResponse.json();
        return threads.value.filter((thread: any) => thread.threadContext !== null);
    }

    public async GetComments(thread: any): Promise<any> {
        let commentsEndpoint = `${this._collectionUri}${this._teamProjectId}/_apis/git/repositories/${this._repositoryName}/pullRequests/${this._pullRequestId}/threads/${thread.id}/comments?api-version=5.1`;
        let commentsResponse = await fetch(commentsEndpoint, {
            headers: { 'Authorization': `Bearer ${tl.getVariable('System.AccessToken')}`, 'Content-Type': 'application/json' },
            agent: this._httpsAgent
        });

        if (commentsResponse.ok == false) {
            tl.warning(`Failed to retrieve comments from url ${commentsEndpoint} the response was ${commentsResponse.statusText}`);
        }

        return await commentsResponse.json();
    }
}