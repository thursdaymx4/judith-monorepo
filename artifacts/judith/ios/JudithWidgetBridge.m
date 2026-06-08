#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(JudithWidgetBridge, NSObject)

RCT_EXTERN_METHOD(writePayload:(NSString *)json)

@end
