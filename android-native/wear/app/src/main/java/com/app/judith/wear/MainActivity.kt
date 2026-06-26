package com.app.judith.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.app.judith.wear.data.BillStore
import com.app.judith.wear.ui.JudithTheme
import com.app.judith.wear.ui.screens.AskScreen
import com.app.judith.wear.ui.screens.BillCalendarScreen
import com.app.judith.wear.ui.screens.BillDetailScreen
import com.app.judith.wear.ui.screens.FaceScreen
import com.app.judith.wear.ui.screens.UpNextScreen
import com.app.judith.wear.ui.screens.WaitingScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            JudithTheme {
                JudithApp()
            }
        }
    }
}

@Composable
fun JudithApp(store: BillStore = viewModel()) {
    val payload by store.payload.collectAsState()
    val token by store.token.collectAsState()

    // Pull-refresh on launch and whenever we come back to the foreground.
    LaunchedEffect(token) { if (token != null) store.refresh() }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        store.reloadFromPrefs()
        store.syncFromDataLayer()
        if (store.token.value != null) store.refresh()
    }

    // Show bills as soon as a payload arrives — the phone pushes it over the
    // Data Layer even before sign-in. The watch token is only needed for
    // backend actions (refresh / Ask / mark-paid), which degrade gracefully
    // when it's absent. This mirrors the iOS watch (payload drives the UI).
    val ready = payload != null

    Scaffold(modifier = Modifier.fillMaxSize().background(JudithColors.background)) {
        if (!ready) {
            WaitingScreen(connected = token != null)
        } else {
            JudithNav(store)
        }
    }
}

@Composable
private fun JudithNav(store: BillStore) {
    val navController = rememberSwipeDismissableNavController()

    SwipeDismissableNavHost(navController = navController, startDestination = "home") {
        composable("home") {
            val pagerState = rememberPagerState(initialPage = 1) { 4 }
            HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                when (page) {
                    0 -> FaceScreen(store)
                    1 -> UpNextScreen(store) { billId ->
                        navController.navigate("detail/$billId")
                    }
                    2 -> AskScreen(store)
                    else -> BillCalendarScreen(store) { billId ->
                        navController.navigate("detail/$billId")
                    }
                }
            }
        }
        composable("detail/{billId}") { backStack ->
            val billId = backStack.arguments?.getString("billId").orEmpty()
            BillDetailScreen(
                store = store,
                billId = billId,
                onDone = { navController.popBackStack() },
            )
        }
    }
}
