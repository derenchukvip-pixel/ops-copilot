package dev.artsiom.opscopilot.tools;

record FaqMatch(FaqArticle article, int matchedKeywordCount) {

    boolean isConfidentMatch() {
        return matchedKeywordCount > 0;
    }
}
