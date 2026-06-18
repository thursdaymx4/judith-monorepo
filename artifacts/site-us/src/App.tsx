import { Switch, Route, Router as WouterRouter } from "wouter";
import Landing from "@/pages/Landing";
import Support from "@/pages/Support";
import Changelog from "@/pages/Changelog";
import VsSiri from "@/pages/VsSiri";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/support" component={Support} />
      <Route path="/changelog" component={Changelog} />
      <Route path="/vs-siri" component={VsSiri} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

export default App;
