require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'JudithFinanceKit'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = ''
  s.homepage       = 'https://github.com/thursdaymx4/judith-monorepo'
  # FinanceKit ships in iOS 17.4+, but the Swift source guards `import
  # FinanceKit` with `#if canImport(FinanceKit)` and every FK API call with
  # `@available(iOS 17.4, *)`. The pod's deployment target must match the
  # host app — otherwise Expo autolinking silently drops the pod for hosts
  # with a lower minimum, and `NativeModules.JudithFinanceKitModule` ends up
  # null at runtime.
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.frameworks = ['FinanceKit']

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
