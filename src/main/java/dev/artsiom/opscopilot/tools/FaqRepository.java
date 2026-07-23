package dev.artsiom.opscopilot.tools;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;

/**
 * A deliberately simple keyword-overlap "RAG" over a handful of static FAQ articles (FR4 permits
 * "упрощённый RAG на 5-10 статьях" — a vector search here would be solving a problem this demo
 * doesn't have). Loaded once at startup from the bundled faq.json.
 */
@Component
class FaqRepository {

    private final List<FaqArticle> articles;

    FaqRepository(ObjectMapper objectMapper) {
        try (InputStream in = getClass().getResourceAsStream("/faq/faq.json")) {
            if (in == null) {
                throw new IllegalStateException("faq/faq.json not found on classpath");
            }
            this.articles = List.copyOf(objectMapper.readValue(in, new TypeReference<List<FaqArticle>>() {
            }));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load FAQ articles", e);
        }
    }

    FaqMatch findBestMatch(String query) {
        String normalized = query.toLowerCase(Locale.ROOT);
        FaqArticle best = articles.get(0);
        int bestScore = 0;

        for (FaqArticle article : articles) {
            int score = (int) article.keywords().stream()
                    .filter(keyword -> normalized.contains(keyword.toLowerCase(Locale.ROOT)))
                    .count();
            if (score > bestScore) {
                bestScore = score;
                best = article;
            }
        }
        return new FaqMatch(best, bestScore);
    }
}
