package com.app.judith.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text

/** A small coloured dot used for urgency indicators. */
@Composable
fun Dot(color: Color, sizeDp: Int) {
    Box(
        modifier = Modifier
            .size(sizeDp.dp)
            .background(color, CircleShape)
    )
}

/** A pill/capsule with a background tint and centred text. */
@Composable
fun Capsule(
    text: String,
    bg: Color,
    textColor: Color,
    bold: Boolean = true,
) {
    Box(
        modifier = Modifier
            .background(bg, RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = text,
            color = textColor,
            fontSize = 12.sp,
            fontWeight = if (bold) androidx.compose.ui.text.font.FontWeight.Bold
            else androidx.compose.ui.text.font.FontWeight.Medium,
        )
    }
}

/** accent @ 12% / 15% alpha — used for streak / confirm tints. */
fun Color.alpha12(): Color = copy(alpha = 0.12f)
fun Color.alpha15(): Color = copy(alpha = 0.15f)
