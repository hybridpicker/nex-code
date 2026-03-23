module.exports = {
  name: "docker-deploy",
  description: "Docker deployment helpers for containerized applications",
  instructions: `When deploying Docker containers:
1. Always build with --no-cache for production images
2. Use multi-stage builds to minimize image size
3. Tag with both latest and version-specific tags
4. Run health checks after deployment
5. Keep the previous image as rollback target`,
  commands: [
    {
      cmd: "/docker-build",
      desc: "Build and tag Docker image",
    },
  ],
  tools: [],
};
