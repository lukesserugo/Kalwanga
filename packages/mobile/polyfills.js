// Polyfill for NativeWind v4 on RN 0.73
// RN 0.74 exposes useColorScheme from react-native; 0.73 doesn't
const rn = require("react-native");
if (!rn.useColorScheme) {
  const { Appearance } = rn;
  rn.useColorScheme = () => {
    const [scheme, setScheme] = require("react").useState(
      Appearance.getColorScheme()
    );
    require("react").useEffect(() => {
      const sub = Appearance.addChangeListener(({ colorScheme }) =>
        setScheme(colorScheme)
      );
      return () => sub.remove();
    }, []);
    return scheme;
  };
}
