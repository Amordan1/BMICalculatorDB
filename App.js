import React, { useState, useEffect } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from "expo-sqlite";
import * as SplashScreen from 'expo-splash-screen'

function openDatabase() {
  if (Platform.OS === "web") {
    return {
      transaction: () => {
        return {
          executeSql: () => {},
        };
      },
    };
  }

  const db = SQLite.openDatabase("db.db");
  return db;
}

const db = openDatabase();

function Items({ done: doneHeading, onPressItem }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    db.transaction((tx) => {
      tx.executeSql(
        `select id, value, date(itemDate) as itemDate from items order by itemDate desc;`,
        null,
        (_, { rows: { _array } }) => setItems(_array)
      );
    });
  }, []);

  const heading = "BMI History";

  if (items === null || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {items.map(({ id, done, value, itemDate }) => (
        <TouchableOpacity
          key={id}
          onPress={() => onPressItem && onPressItem(id)}
          style={{
            backgroundColor: done ? "#1c9963" : "#fff",
            borderColor: "#000",
            borderWidth: 1,
            padding: 8,
          }}
        >
          <Text style={{ color: done ? "#fff" : "#000" }}>{itemDate}:  {value}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function App() {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [results, setResults] = useState('');
  const [data, setData] = useState('Null first value, please click again');
  const [danger, setDanger] = useState(false);
  const [forceUpdate, forceUpdateId] = useForceUpdate();

  SplashScreen.preventAutoHideAsync();
  setTimeout(SplashScreen.hideAsync, 2000)

  const heightKey = '@MyApp:key1';
  const resultsKey = '@MyApp:key3';

  async function onCalc(){
    setResults({ results: 'Loading, please wait...' });
    if (isNaN(weight)) {
      const results = 'Weight must be a number.';
      const danger = true;
      setDanger(danger);
      setResults(results);    
    } else if (('' === weight) || (weight == 0)) {
      const results = 'Please enter weight.';
      const danger = true;
      setDanger(danger);
      setResults(results);
    } else if (isNaN(height)) {
      const results = 'Height must be a number.';
      const danger = true;
      setDanger(danger);
      setResults(results);
    } else if (('' === height) || (height == 0)) {
      const results = 'Please enter height.';
      const danger = true;
      setDanger(danger);
      setResults(results);
    } else {
      const danger = false;
      setDanger(danger)
      const bmi = ((weight/(height*height))*703).toFixed(1);
      const data = bmi + ' (W:'+ weight + ', H:' + height +')';
      let level = "";
      if (bmi < 18.5) {
        level = "(Underweight)";
      } else if (bmi >= 18.5 && bmi <= 24.9) {
        level = "(Healthy)";
      } else if (bmi >= 25 && bmi <= 29.9) {
        level = "(Overweight)";
      } else if (bmi >= 30) {
        level = "(Obese)";
      };
      const results = 'Body Mass Index is ' + bmi + '\n' + level;
      setResults(results)
      setData(data)
      onSave();
      add();
    };
  };

  async function onLoad(){
    try {
      const height = await AsyncStorage.getItem(heightKey);
      setHeight(height);
      const results = await AsyncStorage.getItem(resultsKey);
      setResults(results);
    } catch (error) {
      Alert.alert('Error', 'There was an error while loading the data');
    }
  }

  async function onSave(){

    try {
      await AsyncStorage.setItem(heightKey, height);
      await AsyncStorage.setItem(resultsKey, results);
      Alert.alert('Saved', 'Successfully saved on device');
    } catch (error) {
      Alert.alert('Error', 'There was an error while saving the data');
      console.log(error)
    }
  }

  useEffect(() => {
    db.transaction((tx) => {
      tx.executeSql(
        "drop table items;"
      );
      tx.executeSql(
        "create table if not exists items (id integer primary key not null, done int, value text, itemDate real);"
      );
    });
    onLoad();
  }, []);

  async function add(text) {
    // is text empty?
    if (text === null || text === "") {
      return false;
    }
    db.transaction(
      (tx) => {
        tx.executeSql("insert into items (done, value, itemDate) values (0, ?, julianday('now'))", [data]);
        tx.executeSql("select * from items", [], (_, { rows }) =>
          console.log(JSON.stringify(rows))
        );
      },
      null,
      forceUpdate
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>BMI Calculator</Text>

      {Platform.OS === "web" ? (
        <View
          style={styles.osWarning}
        >
          <Text style={styles.heading}>
            Expo SQlite is not supported on web!
          </Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.flexRow}>
            <TextInput
              onChangeText={(text) => setWeight(text)}
              placeholder="Weight in Pounds"
              style={styles.input}
              value={weight}
            />
            <TextInput
              onChangeText={(text) => setHeight(text)}
              placeholder="Height in Inches"
              style={styles.input}
              value={height}
            />
            <TouchableOpacity onPress={onCalc} style={styles.button}>
              <Text style={styles.buttonText}>Compute BMI</Text>
            </TouchableOpacity>
            {(danger?<TextInput
            style={styles.previewDanger}
            value={results}
            placeholder=" "
            editable={false}
            multiline
          />:
          <TextInput
            style={styles.preview}
            value={results}
            placeholder=" "
            editable={false}
            multiline
          />
          )}
          </ScrollView>
          <ScrollView style={styles.listArea}>
            <Items
              done
              key={`forceupdate-done-${forceUpdateId}`}
              onPressItem={(id) =>
                db.transaction(
                  (tx) => {
                    tx.executeSql(`delete from items where id = ?;`, [id]);
                  },
                  null,
                  forceUpdate
                )
              }
            />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

function useForceUpdate() {
  const [value, setValue] = useState(0);
  return [() => setValue(value + 1), value];
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
  osWarning: {
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center"
  },
  heading: {
    backgroundColor: '#f4511e',
    color: '#fff',
    textAlign: 'center',
    padding: 30,
    fontSize: 28,
    fontWeight: 'bold'
  },
  flexRow: {
    flex: 1,
    padding: 10,
  },
  input: {
    backgroundColor: '#ecf0f1',
    borderRadius: 3,
    height: 45,
    padding: 5,
    marginBottom: 10,
    flex: 1,
    fontSize: 24
  },
  listArea: {
    backgroundColor: "#f0f0f0",
    flex: 1,
    paddingTop: 16,
  },
  sectionContainer: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  sectionHeading: {
    fontSize: 18,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#34495e',
    padding: 10,
    borderRadius: 3,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 24
  },
  preview: {
    color: '#000',
    flex: 1,
    height: 80,
    fontSize: 30,
    marginVertical: 40,
    textAlign: 'center'
  },
  previewDanger: {
    color: '#FF0000',
    flex: 1,
    height: 80,
    fontSize: 30,
    marginVertical: 40,
    textAlign: 'center'
  },
});