import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';


export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Futuristek</Text>
      <Text style={styles.subtitle}>Smart Living Starts Here</Text>

     <TouchableOpacity 
      style={styles.button}
      onPress={() => router.push('/explore')}
      >
      <Text style={styles.buttonText}>Shop Smart Devices</Text>
     </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#38BDF8',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 10,
    color: 'white',
  },

  button: {
  marginTop: 25,
  backgroundColor: '#38BDF8',
  paddingVertical: 12,
  paddingHorizontal: 25,
  borderRadius: 8,
},

buttonText: {
  color: '#0F172A',
  fontWeight: 'bold',
},

});
