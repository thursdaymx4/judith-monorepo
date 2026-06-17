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
  # FinanceKit ships in iOS 17.4+. Setting the deployment target to 17.4
  # for THIS pod only (the rest of the app stays on its own min) makes the
  # Swift compiler tolerate the unguarded `import FinanceKit` below; runtime
  # availability is gated separately via #available checks.
  s.platforms      = { :ios => '17.4' }
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
