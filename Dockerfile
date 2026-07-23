# Build stage — compiles the jar with a full JDK + Maven, cached by dependency layer.
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

COPY src ./src
RUN ./mvnw -B -DskipTests package

# Run stage — slim JRE only, non-root user.
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

RUN groupadd --system opscopilot && useradd --system --gid opscopilot opscopilot
COPY --from=build /workspace/target/ops-copilot-*.jar app.jar
USER opscopilot

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
