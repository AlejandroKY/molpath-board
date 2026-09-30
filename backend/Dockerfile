# Contexto de build: raíz del repositorio (necesita /demo-data). Ver docker-compose.yml.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY demo-data demo-data
COPY backend/.mvn backend/.mvn
COPY backend/mvnw backend/pom.xml backend/
RUN cd backend && chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY backend/src backend/src
RUN cd backend && ./mvnw -q -B -DskipTests package

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 10001 molpath
WORKDIR /app
COPY --from=build /src/backend/target/molpath-board-backend-*.jar /app/app.jar
USER molpath
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
