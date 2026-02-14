import { View, Text, StyleSheet, FlatList, Image } from 'react-native';

const products = [
  {
    id: '1',
    name: 'Smart WiFi E27 LED Bulb',
    price: 'From £14.99',
    image: require('../../assets/images/led-bulb.webp'),
  },
  {
    id: '2',
    name: 'Smart WiFi Plug EU (2-pin)',
    price: 'From £19.99',
    image: require('../../assets/images/smart-plug.webp'),
  },
  {
    id: '3',
    name: 'Smart WiFi Touch Light Switch',
    price: '£24.99',
    image: require('../../assets/images/touch-switch.webp'),
  },
  {
    id: '4',
    name: 'Tuya Smart Door & Window Sensor',
    price: '£14.99',
    image: require('../../assets/images/door-sensor.webp'),
  },
];



export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Futuristek Products</Text>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
       <View style={styles.card}>
        <Image source={item.image} style={styles.image} resizeMode="cover" />
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.price}>{item.price}</Text>
       </View>

        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#38BDF8',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  productName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  image: {
  width: '100%',
  height: 150,
  borderRadius: 10,
  marginBottom: 10,
},

  price: {
    color: '#38BDF8',
    marginTop: 5,
  },
});

