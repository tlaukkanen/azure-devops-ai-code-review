# AI Code Review DevOps Extension

## Supercharge Your Code Reviews with Azure Open AI Services

Use your own Azure OpenAI service endpoints to provide pull request code reviews while keeping your code private.

- **Automated Code Reviews:** Say goodbye to manual code inspections! Let Open AI analyze your code changes, catching bugs, performance issues, and suggesting best practices.
- **Effortless Installation:** A simple one-click installation from the [Azure DevOps Marketplace]([https://marketplace.visualstudio.com/azuredevops](https://marketplace.visualstudio.com/items?itemName=AidanCole.oaicr)) gets you up and running instantly.
- **AI-Powered Insights:** Leverage the latest advancements in natural language processing to receive insightful comments on your pull requests.
- **Faster Reviews:** Reduce the time spent on code reviews. Let Open AI handle the routine, allowing your team to focus on impactful work.
- **Configurable and Customizable:** Tailor the extension to your needs with customizable settings. Specify the Open AI model, define file exclusions, and more.

![](images/ai-review-buddy-640.png)

## Prerequisites

- [Azure DevOps Account](https://dev.azure.com/)
- Azure OpenAI endpoint URI
- Azure OpenAI endpoint key
- Optional: Pricing for input and output tokens (check from [Azure OpenAI Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/#pricing))

## Getting started

1. Install the AI Code Review DevOps Extension from the Azure DevOps Marketplace.
2. Add Open AI Code Review Task to Your Pipeline:

  ```yaml
  trigger:
    branches:
      exclude:
        - '*'

  pr:
    branches:
      include:
        - '*'

  jobs:
  - job: CodeReview
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    - task: AICodeReview@1
      inputs:
        azureOpenAiDeploymentEndpointUrl: $(AzureOpenAiDeploymentEndpoint)
        azureOpenAiApiKey: $(AzureOpenAiDeploymentKey)
        azureOpenAiApiVersion: "2024-07-01-preview"
        promptTokensPricePerMillionTokens: "0.15"
        completionTokensPricePerMillionTokens: "0.6"
        bugs: true
        performance: true
        bestPractices: true
        fileExtensions: '.js,.ts,.css,.html,.py,.tf'
        fileExcludes: 'file1.js,file2.py,secret.txt'
        additionalPrompts: |
          Fix variable naming, Ensure consistent indentation, Review error handling approach
  ```

3. If you do not already have Build Validation configured for your branch already add [Build validation](https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies?view=azure-devops&tabs=browser#build-validation) to your branch policy to trigger the code review when a Pull Request is created

## FAQ

### Q: What agent job settings are required?

A: Ensure that "Allow scripts to access OAuth token" is enabled as part of the agent job. Follow the [documentation](https://learn.microsoft.com/en-us/azure/devops/pipelines/build/options?view=azure-devops#allow-scripts-to-access-the-oauth-token) for more details.

### Q: What permissions are required for Build Administrators?

A: Build Administrators must be given "Contribute to pull requests" access. Check [this Stack Overflow answer](https://stackoverflow.com/a/57985733) for guidance on setting up permissions.

### Bug Reports

If you find a bug or unexpected behavior, please [open a bug report](https://github.com/tlaukkanen/azure-devops-ai-code-review/issues/new?assignees=&labels=bug&template=bug_report.md&title=).

### Feature Requests

If you have ideas for new features or enhancements, please [submit a feature request](https://github.com/tlaukkanen/azure-devops-ai-code-review/issues/new?assignees=&labels=enhancement&template=feature_request.md&title=).

## License

This project is licensed under the [MIT License](LICENSE).

If you would like to contribute to the development of this extension, please follow our contribution guidelines.

Project was originally forked from [a1dancole/OpenAI-Code-Review](https://github.com/a1dancole/OpenAI-Code-Review).
