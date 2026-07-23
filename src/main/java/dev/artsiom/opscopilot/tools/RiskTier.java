package dev.artsiom.opscopilot.tools;

/**
 * FR4 risk classification for a tool. SAFE tools execute immediately; REQUIRES_APPROVAL tools
 * always go through the PendingAction queue (FR5) regardless of classification confidence.
 */
public enum RiskTier {
    SAFE,
    REQUIRES_APPROVAL
}
