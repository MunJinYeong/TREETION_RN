import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ActivityIndicator, Alert, AppState } from 'react-native';
import { WebView } from 'react-native-webview';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';
import { Audio } from 'expo-av';

export default function WebViewApp() {
  // 상태 관리
  const [isLoading, setIsLoading] = useState(true);  // 웹뷰 로딩 상태
  const [canGoBack, setCanGoBack] = useState(false); // 뒤로가기 가능 여부
  const [isRecording, setIsRecording] = useState(false); // 녹음 상태

  // Ref 관리
  const webViewRef = useRef<WebView>(null);          // 웹뷰 참조
  const recordingRef = useRef<Audio.Recording | null>(null); // 녹음 인스턴스 참조
  const appState = useRef(AppState.currentState);    // 앱 상태 참조

  // 앱 상태 변경 감지
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isRecording
      ) {
        // 앱이 백그라운드에서 포그라운드로 돌아올 때 녹음 상태 확인
        console.log('앱이 포그라운드로 돌아옴');
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isRecording]);

  // 앱 시작시 마이크 권한 요청
  useEffect(() => {
    const getPermission = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('권한 필요', '녹음을 위해 마이크 권한이 필요합니다.');
        }
      } catch (error) {
        console.error('권한 요청 실패:', error);
      }
    };
    getPermission();
  }, []);

  //네이티브 녹음 시작 함수
  const startNativeRecording = async () => {
    try {
      // 권한 재확인
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '녹음을 위해 마이크 권한이 필요합니다.');
        return;
      }

      // 새로운 녹음 인스턴스 생성
      const recording = new Audio.Recording();
      recordingRef.current = recording;

      // 고품질 녹음 설정 적용 및 녹음 시작
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      await recording.startAsync();
      setIsRecording(true);
      console.log('녹음 시작');
    } catch (error) {
      console.error('녹음 시작 실패:', error);
      Alert.alert('오류', '녹음을 시작할 수 없습니다.');
    }
  };

  // 녹음 중지 및 URI 전송 함수
  const stopAndSendUri = async () => {
    try {
      if (!recordingRef.current) return;

      // 녹음 중지 및 언로드
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      console.log('녹음 URI:', uri);

      // 웹뷰로 녹음 파일 URI 전송
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'RECORDING_COMPLETED',
        uri: uri
      }));

      // 녹음 인스턴스 초기화
      recordingRef.current = null;
      setIsRecording(false);
    } catch (error) {
      console.error('녹음 종료 실패:', error);
      Alert.alert('오류', '녹음을 저장할 수 없습니다.');
    }
  };

  //웹뷰 네비게이션 상태 변경 핸들러, 뒤로가기 가능 여부를 추적
  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  // 웹뷰로부터 메시지 수신 핸들러
  const onMessage = async (e: any) => {
    try {
      const { type } = JSON.parse(e.nativeEvent.data);
      if (type === 'START_RECORD') {
        await startNativeRecording();
      }
      if (type === 'STOP_RECORD') {
        await stopAndSendUri();
      }
    } catch (error) {
      console.error('메시지 처리 실패:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://treetion.com' }}
        style={styles.webview}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={onMessage}  // 웹으로부터 메시지 수신
        allowsBackForwardNavigationGestures={true}  // iOS 스와이프 네비게이션 활성화
      />
      {/* 로딩 인디케이터 */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3356e4" />
        </View>
      )}
    </SafeAreaView>
  );
}

// 스타일 정의
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});


/* 웹 사이드 코드 예시

// React Native 환경 탐지 및 녹음 신호 전송
if (window.ReactNativeWebView) {
  // React Native 환경일 때 네이티브 녹음 사용
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'START_RECORD' }));
} else {
  // 일반 웹 브라우저일 때는 MediaRecorder API 사용
}

// 녹음 파일 수신 및 처리
window.addEventListener('message', (event) => {
  const { type, uri } = JSON.parse(event.data);
  if (type === 'RECORDING_COMPLETED') {
    // uri를 사용하여 파일 업로드 또는 재생
    // 예: 서버로 업로드, 오디오 플레이어로 재생 등
  }
});

*/
