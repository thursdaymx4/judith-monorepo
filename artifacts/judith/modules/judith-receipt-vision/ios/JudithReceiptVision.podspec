require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'JudithReceiptVision'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = ''
  s.homepage       = 'https://github.com/thursdaymx4/judith-monorepo'
  # Vision framework ships in iOS 13+. The pod's deployment target must match
  # the host app — otherwise Expo autolinking silently drops the pod for hosts
  # with a lower minimum and NativeModules.JudithReceiptVisionModule ends up
  # null at runtime. Runtime is guarded by @available so older OS users get a
  # graceful unavailable result instead of a crash.
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.frameworks = ['Vision', 'CoreImage', 'UIKit']

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
