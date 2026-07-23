package dev.artsiom.opscopilot.tools;

import java.util.List;

record FaqArticle(String id, String question, List<String> keywords, String answer) {
}
