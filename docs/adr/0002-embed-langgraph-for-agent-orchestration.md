# Embed LangGraph for agent orchestration

Comms Digest will use the open-source LangGraph.js package to orchestrate the model-driven workflow, including specialist stages, conditional routing, retries, and human review. It will run inside services deployed on Railway and persist checkpoints in PostgreSQL; the project will not depend on LangSmith Deployment or introduce a separate workflow platform unless operational needs later justify one.
