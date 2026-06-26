package com.app.judith.wear.ui

import androidx.compose.runtime.Composable
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme
import com.app.judith.wear.JudithColors

private val JudithWearColors = Colors(
    primary = JudithColors.accent,
    primaryVariant = JudithColors.ok,
    secondary = JudithColors.near,
    secondaryVariant = JudithColors.urgent,
    background = JudithColors.background,
    surface = JudithColors.surface1,
    error = JudithColors.overdue,
    onPrimary = JudithColors.background,
    onSecondary = JudithColors.background,
    onBackground = JudithColors.txtHi,
    onSurface = JudithColors.txtHi,
    onSurfaceVariant = JudithColors.txtMid,
    onError = JudithColors.txtHi,
)

@Composable
fun JudithTheme(content: @Composable () -> Unit) {
    MaterialTheme(colors = JudithWearColors, content = content)
}
