
import { View, Text, TouchableOpacity, Image,  StyleSheet, } from "react-native";
import { STOP_SIGN } from "../assets";
export default function SecureLockedCard({ title, description, onUnlock }) {
	
	
	return (
		<View style={styles.card}>
		 
			<Image source={STOP_SIGN} style={styles.stopSign} />	
			
			<Text style={{ fontWeight: "600", fontSize: 20 }}>{title}</Text>
		  
			<Text style={{ marginVertical: 18 }}>{description}</Text>

			<TouchableOpacity onPress={onUnlock}>
				<Text style={{fontSize: 18, color: "#007AFF", fontWeight: "600" }}>
				  Unlock to continue
				</Text>
			</TouchableOpacity>
			
		</View>
	);
}
const styles = StyleSheet.create({

  h1: { fontSize: 20, fontWeight: "900", color: "#111827" },
 
 card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "red",
    paddingHorizontal: 12,
    paddingVertical: 34,
    alignItems: "center",
    marginTop: 50,		
  },
  stopSign: { 
  width: 80,
  height: 80,
  marginBottom: 30,	 
  resizeMode: "contain"
  },	
});	